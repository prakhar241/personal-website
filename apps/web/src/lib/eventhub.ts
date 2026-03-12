// ============================================
// Azure Event Hubs Producer (Kafka-compatible)
//
// Sends telemetry events to Azure Event Hubs
// which supports the Kafka protocol natively.
// Events are consumed by:
//   - Azure Data Explorer (ADX) for KQL queries
//   - Azure Databricks for analytics
//   - Azure Monitor via OTel Collector
// ============================================

import {
  EventHubProducerClient,
  EventHubBufferedProducerClient,
} from "@azure/event-hubs";

let producer: EventHubBufferedProducerClient | null = null;
let simpleProducer: EventHubProducerClient | null = null;

interface TelemetryEventPayload {
  eventType: string;
  timestamp: string;
  sessionId: string;
  visitorId: string;
  url: string;
  path: string;
  referrer: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  timezone: string;
  country: string | null;
  city: string | null;
  region: string | null;
  ip: string | null;
  properties: Record<string, string>;
}

function getConnectionString(): string | null {
  return process.env.EVENTHUB_CONNECTION_STRING || null;
}

function getEventHubName(): string {
  return process.env.EVENTHUB_NAME || "telemetry-events";
}

function getProducer(): EventHubBufferedProducerClient | null {
  if (producer) return producer;

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.warn(
      "[EventHub] EVENTHUB_CONNECTION_STRING not set - events will be logged only"
    );
    return null;
  }

  producer = new EventHubBufferedProducerClient(
    connectionString,
    getEventHubName(),
    {
      maxWaitTimeInMs: 5000,
      maxEventBufferLengthPerPartition: 100,
      onSendEventsErrorHandler: (ctx) => {
        console.error(
          `[EventHub] Failed to send ${ctx.events.length} events:`,
          ctx.error
        );
      },
    }
  );

  return producer;
}

function getSimpleProducer(): EventHubProducerClient | null {
  if (simpleProducer) return simpleProducer;

  const connectionString = getConnectionString();
  if (!connectionString) return null;

  simpleProducer = new EventHubProducerClient(
    connectionString,
    getEventHubName()
  );
  return simpleProducer;
}

/**
 * Send a batch of telemetry events to Azure Event Hubs.
 * Uses the buffered producer for high-throughput scenarios.
 * Falls back to simple producer if buffered fails.
 */
export async function sendEventsToEventHub(
  events: TelemetryEventPayload[]
): Promise<void> {
  // Try buffered producer first
  const buffered = getProducer();
  if (buffered) {
    for (const event of events) {
      await buffered.enqueueEvent({
        body: event,
        contentType: "application/json",
        properties: {
          eventType: event.eventType,
          visitorId: event.visitorId,
          country: event.country || "unknown",
        },
      });
    }
    return;
  }

  // Fallback: simple producer with explicit batch
  const simple = getSimpleProducer();
  if (simple) {
    const batch = await simple.createBatch();
    for (const event of events) {
      const added = batch.tryAdd({
        body: event,
        contentType: "application/json",
        properties: {
          eventType: event.eventType,
          visitorId: event.visitorId,
          country: event.country || "unknown",
        },
      });
      if (!added) {
        // Batch full, send and create new one
        await simple.sendBatch(batch);
        const newBatch = await simple.createBatch();
        newBatch.tryAdd({
          body: event,
          contentType: "application/json",
          properties: {
            eventType: event.eventType,
            visitorId: event.visitorId,
            country: event.country || "unknown",
          },
        });
      }
    }
    if (batch.count > 0) {
      await simple.sendBatch(batch);
    }
    return;
  }

  // No Event Hub configured - log events for development
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[EventHub:dev] Would send ${events.length} events:`,
      events.map((e) => `${e.eventType}:${e.path}`)
    );
  }
}

/**
 * Gracefully close the Event Hub producers on shutdown.
 */
export async function closeEventHubProducer(): Promise<void> {
  if (producer) {
    await producer.close();
    producer = null;
  }
  if (simpleProducer) {
    await simpleProducer.close();
    simpleProducer = null;
  }
}
