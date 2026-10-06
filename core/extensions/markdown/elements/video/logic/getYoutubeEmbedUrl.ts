// Gramax desktop serves its UI from tauri://localhost, and YouTube refuses to play an embed
// whose Referer is not http(s) (error 153). There the player goes through a static page on
// our https domain, which embeds YouTube itself.
export const YOUTUBE_PROXY_PAGE_URL = "https://gram.ax/embed/youtube.html";

export const getYoutubeVideoId = (url: string): string | undefined =>
	url.match(/youtu\.be\/([^?&#/]+)/)?.[1] ?? url.match(/(?:[?&]v=|\/(?:embed|shorts|live)\/)([^?&#/]+)/)?.[1];

const getYoutubeEmbedUrl = (url: string, useProxyPage = false): string | null => {
	const id = getYoutubeVideoId(url);
	if (!id) return null;

	const start = url.match(/[?&](?:t|start)=(\d+)s?(?:[&#]|$)/)?.[1];
	if (useProxyPage) return `${YOUTUBE_PROXY_PAGE_URL}?v=${id}${start ? `&start=${start}` : ""}`;

	const list = url.match(/[?&]list=([^&#]+)/)?.[1];
	const params = [start && `start=${start}`, list && `list=${list}`].filter(Boolean).join("&");
	return `https://www.youtube.com/embed/${id}${params ? `?${params}` : ""}`;
};

export default getYoutubeEmbedUrl;
