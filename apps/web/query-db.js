const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: { url: 'REDACTED_CONNECTION_STRING' }
  }
});

(async () => {
  console.log('=== LIKES ===');
  const likes = await p.like.findMany({ include: { post: { select: { title: true } } } });
  if (likes.length === 0) console.log('(no likes yet)');
  else console.table(likes.map(l => ({ id: l.id, post: l.post.title, fingerprint: l.visitorFingerprint, createdAt: l.createdAt.toISOString() })));

  console.log('\n=== POSTS ===');
  const posts = await p.post.findMany({ select: { id: true, title: true, status: true, _count: { select: { likes: true, comments: true } } } });
  console.table(posts.map(p => ({ title: p.title, status: p.status, likes: p._count.likes, comments: p._count.comments })));

  console.log('\n=== USERS ===');
  const users = await p.user.findMany({ select: { id: true, name: true, email: true, role: true } });
  console.table(users);

  console.log('\n=== COMMENTS ===');
  const comments = await p.comment.findMany({ include: { post: { select: { title: true } } } });
  if (comments.length === 0) console.log('(no comments yet)');
  else console.table(comments.map(c => ({ author: c.authorName, post: c.post.title, content: c.content.substring(0, 50), createdAt: c.createdAt.toISOString() })));

  console.log('\n=== PAGE VIEWS ===');
  const views = await p.pageView.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
  if (views.length === 0) console.log('(no page views yet)');
  else console.table(views.map(v => ({ path: v.path, referrer: v.referrer || '-', createdAt: v.createdAt.toISOString() })));

  await p.$disconnect();
})();
