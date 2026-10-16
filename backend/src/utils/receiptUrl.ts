// Older rows (before receipts went private) hold a plain public Cloudinary URL; insert a resize into it.
export function resizedPublicUrl(url: string, width: number) {
    return url.replace('/upload/', `/upload/c_limit,w_${width},q_auto,f_auto/`);
}
