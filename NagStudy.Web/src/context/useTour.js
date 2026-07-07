import { createContext, useContext } from "react";

export const TourContext = createContext(null);

export function useTour() {
    return useContext(TourContext);
}