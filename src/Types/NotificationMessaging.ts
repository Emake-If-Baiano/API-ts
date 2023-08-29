import NotificationData from "./NotificationData";

export default interface NotificationMessaging {
    notification: {
        title: string,
        body: string
    },
    token: string,
    data: NotificationData
}