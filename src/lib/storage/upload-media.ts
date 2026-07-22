export const uploadMedia = async () => {};
export const uploadAccountMedia = async (bucket: string, file: File): Promise<{ publicUrl: string }> => { return { publicUrl: "https://example.com/file.jpg" }; };
export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;
