import getYoutubeEmbedUrl, { YOUTUBE_PROXY_PAGE_URL } from "./getYoutubeEmbedUrl";

describe("getYoutubeEmbedUrl", () => {
	it.each([
		["watch", "https://www.youtube.com/watch?v=F4ryW8YBZco", "https://www.youtube.com/embed/F4ryW8YBZco"],
		[
			"watch with extra params",
			"https://youtube.com/watch?list=x&v=F4ryW8YBZco&t=42",
			"https://www.youtube.com/embed/F4ryW8YBZco?start=42&list=x",
		],
		["shorts", "https://www.youtube.com/shorts/F4ryW8YBZco", "https://www.youtube.com/embed/F4ryW8YBZco"],
		["embed", "https://www.youtube.com/embed/F4ryW8YBZco", "https://www.youtube.com/embed/F4ryW8YBZco"],
		["youtu.be", "https://youtu.be/F4ryW8YBZco", "https://www.youtube.com/embed/F4ryW8YBZco"],
		[
			"youtu.be with time",
			"https://youtu.be/F4ryW8YBZco?t=15",
			"https://www.youtube.com/embed/F4ryW8YBZco?start=15",
		],
		[
			"youtu.be from a playlist",
			"https://youtu.be/F4ryW8YBZco?list=PL123&t=15",
			"https://www.youtube.com/embed/F4ryW8YBZco?start=15&list=PL123",
		],
		[
			"youtu.be with share param",
			"https://youtu.be/F4ryW8YBZco?si=abc",
			"https://www.youtube.com/embed/F4ryW8YBZco",
		],
	])("%s", (_, url, expected) => {
		expect(getYoutubeEmbedUrl(url)).toBe(expected);
	});

	it("goes through the proxy page when asked", () => {
		expect(getYoutubeEmbedUrl("https://youtu.be/F4ryW8YBZco?t=15", true)).toBe(
			`${YOUTUBE_PROXY_PAGE_URL}?v=F4ryW8YBZco&start=15`,
		);
		expect(getYoutubeEmbedUrl("https://www.youtube.com/watch?v=F4ryW8YBZco", true)).toBe(
			`${YOUTUBE_PROXY_PAGE_URL}?v=F4ryW8YBZco`,
		);
	});

	it("returns null for a link without a video id", () => {
		expect(getYoutubeEmbedUrl("https://www.youtube.com/@channel")).toBeNull();
	});
});
