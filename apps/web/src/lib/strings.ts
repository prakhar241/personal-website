/**
 * Centralized strings file for the application.
 * All user-facing text should be defined here for easy maintenance and potential i18n.
 */

export const strings = {
  // Site-wide
  common: {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || "My Blog",
    builtWith: "Built with",
    viewAll: "View all",
    all: "All",
    loading: "Loading...",
    backToHome: "Back to Home",
  },

  // Navigation
  nav: {
    home: "Home",
    blog: "Blogs",
    about: "About",
    contact: "Contact",
    dashboard: "Dashboard",
    posts: "Posts",
    signOut: "Sign Out",
    admin: "Admin",
    toggleTheme: "Toggle theme",
    rss: "RSS",
  },

  // Home page
  home: {
    heroGreeting: "Hey, I'm",
    heroHighlight: "a software developer",
    heroSuffix: "with flavour.",
    heroDescription:
      "Welcome to my corner of the internet. I write about software development, technology, and the things I'm building. Grab a coffee and stay a while.",
    readBlog: "Read the Blog",
    aboutMe: "About Me",
    recentPosts: "Recent Posts",
    noPostsYet: "No posts yet. Check back soon!",
  },

  // Blog page
  blog: {
    title: "Blog",
    description: "Thoughts, tutorials, and insights on software development.",
    metaDescription: "Read my latest articles and thoughts on technology.",
    noPosts: "No posts found.",
    prevPage: "Previous",
    nextPage: "Next",
    minRead: "min read",
    likes: "likes",
    comments: "comments",
  },

  // About page
  about: {
    title: "About Me",
    fallbackMessage: "This page hasn't been set up yet. Log in as admin to create it.",
  },

  // Contact page
  contact: {
    title: "Contact",
    fallbackMessage: "This page hasn't been set up yet. Log in as admin to create it.",
  },

  // 404 page
  notFound: {
    title: "404",
    message: "This page doesn't exist.",
  },

  // Auth / Sign in
  auth: {
    adminLogin: "Admin Login",
    signInDescription: "Sign in to access the admin panel.",
    emailLabel: "Email",
    emailPlaceholder: "admin@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    invalidCredentials: "Invalid email or password.",
    adminAccessOnly: "Admin access only.",
    authError: "Authentication Error",
    authErrorMessage: "There was a problem signing in.",
    tryAgain: "Try Again",
  },

  // Comments
  comments: {
    title: "Comments",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    nameRequired: "*",
    emailLabel: "Email",
    emailOptional: "(optional)",
    emailPlaceholder: "your@email.com",
    commentLabel: "Comment",
    commentPlaceholder: "Share your thoughts...",
    postComment: "Post Comment",
    posting: "Posting...",
    posted: "Comment posted!",
    failedToPost: "Failed to post comment",
    noComments: "No comments yet. Be the first to share your thoughts!",
  },

  // Likes
  likes: {
    like: "Like",
    liked: "Liked",
    failedToLike: "Failed to like",
  },

  // Share
  share: {
    share: "Share",
    copyLink: "Copy link",
    linkCopied: "Link copied!",
    shareOnTwitter: "Share on Twitter",
    shareOnLinkedIn: "Share on LinkedIn",
  },

  // Admin
  admin: {
    dashboard: "Dashboard",
    totalPosts: "Total Posts",
    published: "Published",
    drafts: "Drafts",
    totalViews: "Total Views",
    recentViews: "Recent Views",
    totalLikes: "Total Likes",
    totalComments: "Total Comments",
    unreadComments: "Unread",
    topPages: "Top Pages",
    recentComments: "Recent Comments",
    postPerformance: "Post Performance",
    markAsRead: "Mark as read",
    viewPost: "View post",
    createPost: "Create Post",
    editPost: "Edit Post",
    newPost: "New Post",
    postTitle: "Post Title",
    slug: "Slug",
    excerpt: "Excerpt",
    coverImage: "Cover Image",
    tags: "Tags",
    tagsHelp: "Comma-separated",
    status: "Status",
    draft: "Draft",
    publish: "Publish",
    update: "Update",
    saving: "Saving...",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this post?",
    postSaved: "Post saved!",
    postPublished: "Post published!",
    postDeleted: "Post deleted!",
    failedToSave: "Failed to save post",
    failedToDelete: "Failed to delete post",
    noPostsFound: "No posts found",
  },

  // Editor
  editor: {
    preview: "Preview",
    edit: "Edit",
    uploadImage: "Upload Image",
    uploading: "Uploading...",
    uploadFailed: "Upload failed",
    bold: "Bold",
    italic: "Italic",
    heading: "Heading",
    link: "Link",
    code: "Code",
    quote: "Quote",
    list: "List",
  },

  // Errors
  errors: {
    somethingWentWrong: "Something went wrong",
    pageNotFound: "Page not found",
    unauthorized: "Unauthorized",
    forbidden: "You don't have permission to access this page.",
  },

  // Meta
  meta: {
    defaultTitle: "Personal Blog",
    defaultDescription: "A personal blog about software development and technology.",
  },
} as const;

// Type helper for accessing nested string keys
export type StringKey = keyof typeof strings;
