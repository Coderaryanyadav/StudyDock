import katex from "katex";

/**
 * Safely renders TeX equations in HTML string using KaTeX
 */
export function renderMathInText(text: string): string {
  try {
    // Replace block math $$...$$
    let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, equation) => {
      try {
        return katex.renderToString(equation.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch (err) {
        return `<div class="katex-error font-mono text-xs text-rose-400 p-2">${equation}</div>`;
      }
    });

    // Replace inline math $...$
    result = result.replace(/\$([^\$\n]+?)\$/g, (_, equation) => {
      try {
        return katex.renderToString(equation.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch (err) {
        return `<span class="katex-error font-mono text-xs text-rose-400">${equation}</span>`;
      }
    });

    return result;
  } catch (e) {
    return text;
  }
}
