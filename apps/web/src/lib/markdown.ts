import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeSanitize)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return result.toString();
}
