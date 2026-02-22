# Personal Blog Platform

A full-stack blogging platform with Next.js 14, Prisma, PostgreSQL, and Azure deployment.

**Live Site:** https://prakharbansal.in

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Start Infrastructure
```bash
docker-compose up -d
```
This starts PostgreSQL (port 5432), Redis (port 6379), and Adminer (port 8080).

### 2. Configure Environment
```bash
cp apps/web/.env.example apps/web/.env.local
```
Edit `.env.local`:
```env
DATABASE_URL="postgresql://bloguser:blogpass@localhost:5432/blogdb?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
ADMIN_EMAIL="your@email.com"
ADMIN_PASSWORD="YourSecurePassword"
```

### 3. Setup Database & Start
```bash
cd apps/web
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open http://localhost:3000

---

## Development Workflow

### Branch Strategy
- `master` - Production-ready code (protected, requires PR)
- `development` - Active development branch

### Making Changes
```bash
git checkout development
# ... make changes ...
git add . && git commit -m "feat: your change"
git push origin development

# Create PR to merge to master
gh pr create --base master --head development --title "Your PR title"
```

On PR merge to master → Auto-deploys to pre-prod via GitHub Actions.

---

## Pre-prod Environment

### Infrastructure
| Resource | Name | Region |
|----------|------|--------|
| AKS Cluster | blog-preprod-aks | centralus |
| PostgreSQL | blog-preprod-pg.postgres.database.azure.com | centralus |
| ACR | blogacruade2pz6fyows.azurecr.io | centralus |
| Key Vault | blog-preprod-kv | centralus |
| Storage | blogpreprodstuade2pz6fyo | centralus |

### URLs
- **Site:** https://prakharbansal.in (also https://www.prakharbansal.in)
- **Static IP:** 172.202.42.91

---

## Debugging Commands

### Local
```bash
# View Docker containers
docker ps

# View local database (Adminer)
open http://localhost:8080
# Server: blog-postgres, User: bloguser, Pass: blogpass, DB: blogdb

# Reset local database
cd apps/web
npx prisma migrate reset

# Generate Prisma client after schema changes
npx prisma generate
```

### Pre-prod (Kubernetes)
```bash
# Get AKS credentials
az aks get-credentials --resource-group rg-blog-preprod --name blog-preprod-aks

# View pods
kubectl get pods -n blog-preprod

# View pod logs
kubectl logs -n blog-preprod deploy/web --tail=100 -f

# Shell into pod
kubectl exec -it -n blog-preprod deploy/web -- sh

# View all resources
kubectl get all -n blog-preprod

# View ingress and certificates
kubectl get ingress,certificate -n blog-preprod

# Restart deployment
kubectl rollout restart deployment/web -n blog-preprod

# View secrets (decode)
kubectl get secret blog-secrets -n blog-preprod -o jsonpath='{.data.DATABASE_URL}' | base64 -d

# Port forward to local (bypass ingress)
kubectl port-forward -n blog-preprod deploy/web 3000:3000

# View deployment image
kubectl get deployment web -n blog-preprod -o jsonpath='{.spec.template.spec.containers[0].image}'

# Manually set image
kubectl set image deployment/web web=blogacruade2pz6fyows.azurecr.io/blog-web:TAG -n blog-preprod
```

### GitHub Actions
```bash
# View recent pipeline runs
gh run list --limit 5

# View failed run logs
gh run view RUN_ID --log-failed

# Watch pipeline
gh run watch
```

### Azure CLI
```bash
# List ACR images
az acr repository show-tags --name blogacruade2pz6fyows --repository blog-web -o table

# Build and push image manually
az acr build --registry blogacruade2pz6fyows --image blog-web:v1 --file apps/web/Dockerfile .

# View PostgreSQL connection
az keyvault secret show --vault-name blog-preprod-kv --name database-url --query value -o tsv
```

---

## Manual Deployment (Pre-prod)

If CI/CD fails or for debugging:

```bash
# 1. Build image
az acr build --registry blogacruade2pz6fyows --image blog-web:manual --file apps/web/Dockerfile .

# 2. Apply kustomize
cd k8s/overlays/preprod
kustomize edit set image blogacruade2pz6fyows.azurecr.io/blog-web=blogacruade2pz6fyows.azurecr.io/blog-web:manual
kubectl apply -k .

# 3. Or just update image
kubectl set image deployment/web web=blogacruade2pz6fyows.azurecr.io/blog-web:manual -n blog-preprod
```

---

## Production Environment

**Status:** Not deployed

Production will use:
- Resource Group: `rg-blog-prod`
- AKS: `blog-prod-aks`
- Namespace: `blog-prod`
- Manual approval gate in GitHub Actions

To deploy prod: Trigger workflow_dispatch with `deploy_target: prod`.

---

## Project Structure

```
├── apps/web/               # Next.js application
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   └── lib/            # Utilities, Prisma client
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Seed data
│   └── Dockerfile          # Multi-stage Docker build
├── k8s/
│   ├── base/               # Base Kubernetes manifests
│   └── overlays/
│       ├── preprod/        # Pre-prod kustomize overlay
│       └── prod/           # Prod kustomize overlay
├── infra/
│   ├── main.bicep          # Azure infrastructure
│   └── modules/            # Bicep modules
├── .github/workflows/
│   └── deploy.yml          # CI/CD pipeline
└── docker-compose.yml      # Local development
```

---

## Key Features

- **Role-based access:** Admin/Author/Reader roles
- **Markdown editor:** With image upload to Azure Blob Storage
- **Draft/Publish workflow:** Posts can be drafted before publishing
- **Static pages:** About, Contact pages
- **Likes & Comments:** Visitor engagement
- **HTTPS:** Let's Encrypt via cert-manager
- **CI/CD:** GitHub Actions with OIDC auth to Azure

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Base URL of the site |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `ADMIN_EMAIL` | Yes | Email for admin account |
| `ADMIN_PASSWORD` | Seed | Password for initial admin (seed only) |
| `AZURE_STORAGE_ACCOUNT_NAME` | Yes | Azure Storage account for images |
| `AZURE_STORAGE_ACCOUNT_KEY` | Yes | Storage account access key |
| `AZURE_STORAGE_CONTAINER_NAME` | Yes | Blob container name |
| `REDIS_URL` | No | Redis for caching (optional) |

---

## Troubleshooting

### "ADMIN_PASSWORD environment variable is required"
Set `ADMIN_PASSWORD` in `.env.local` before running `npx prisma db seed`.

### Certificate not issuing
```bash
kubectl describe certificate prakharbansal-tls -n blog-preprod
kubectl describe challenge -n blog-preprod
```

### Pod stuck in CrashLoopBackOff
```bash
kubectl logs -n blog-preprod deploy/web --previous
kubectl describe pod -n blog-preprod -l app=web
```

### Database connection failed
```bash
# Test from pod
kubectl exec -it -n blog-preprod deploy/web -- sh
wget -qO- --timeout=5 $DATABASE_URL || echo "Connection failed"
```
