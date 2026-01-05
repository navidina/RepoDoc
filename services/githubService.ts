
export interface GithubNode {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
  size?: number;
}

export const parseGithubUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;
    return { owner: pathParts[0], repo: pathParts[1] };
  } catch (e) {
    return null;
  }
};

export const fetchGithubRepoTree = async (owner: string, repo: string) => {
  // Try 'main' first, then 'master'
  const branches = ['main', 'master'];
  
  for (const branch of branches) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
      if (response.ok) {
        const data = await response.json();
        return { tree: data.tree as GithubNode[], branch };
      }
    } catch (e) {
      console.warn(`Failed to fetch branch ${branch}`, e);
    }
  }
  throw new Error('Repository not found or accessed denied (Check if private).');
};

export const fetchGithubFileContent = async (owner: string, repo: string, branch: string, path: string): Promise<string> => {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    if (!response.ok) throw new Error('Failed to fetch file');
    return await response.text();
  } catch (e) {
    console.error(`Error fetching ${path}`, e);
    return '';
  }
};
