import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export async function readJsonFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export async function writeJsonFile(filePath, data) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
export async function readTextFile(filePath) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return '';
    }
}
export function getProjectFile(projectPath, filename) {
    return path.join(projectPath, filename);
}
//# sourceMappingURL=file-io.js.map