export const analyzeDocQuality = (doc: string) => {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings = Array.from(doc.matchAll(headingRegex)).map(match => match[1].trim());
  const duplicates = headings.filter((heading, index) => headings.indexOf(heading) !== index);
  const uniqueDuplicates = Array.from(new Set(duplicates));
  const todoMatches = doc.match(/\bTODO\b|\bFIXME\b/gi) || [];

  const warnings: string[] = [];
  if (uniqueDuplicates.length) {
    warnings.push(`سرفصل‌های تکراری: ${uniqueDuplicates.join('، ')}`);
  }
  if (todoMatches.length) {
    warnings.push(`موارد TODO/FIXME: ${todoMatches.length} مورد`);
  }

  return {
    headingCount: headings.length,
    duplicateHeadings: uniqueDuplicates,
    todoCount: todoMatches.length,
    warnings
  };
};
