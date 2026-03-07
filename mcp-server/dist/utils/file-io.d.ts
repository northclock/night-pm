export declare function readJsonFile<T>(filePath: string): Promise<T[]>;
export declare function writeJsonFile<T>(filePath: string, data: T[]): Promise<void>;
export declare function readTextFile(filePath: string): Promise<string>;
export declare function getProjectFile(projectPath: string, filename: string): string;
