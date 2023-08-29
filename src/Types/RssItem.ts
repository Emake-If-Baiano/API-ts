export default interface RssItem {
    title: string;
    'content:encoded'?: string;
    description?: string;
    link: string;
    pubDate: string;
    site: string;
}