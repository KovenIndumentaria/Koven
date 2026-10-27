import { createContext, useContext } from "react";

export const OrderNotificationsContext = createContext(null);
export const useOrderNotificationSettings = () => useContext(OrderNotificationsContext);
