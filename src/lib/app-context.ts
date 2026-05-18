import { createContext, useContext } from "react";

export interface AppCtx {
  isAdmin: boolean;
  userId: string;
}

export const AppContext = createContext<AppCtx>({ isAdmin: false, userId: "" });
export const useAppCtx = () => useContext(AppContext);
