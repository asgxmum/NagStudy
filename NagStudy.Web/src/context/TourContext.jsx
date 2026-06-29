import { createContext, useState } from "react";
import { TOUR_PAGES } from "./tourPages";
import { TourContext } from "./useTour";
import api from "../api/client";

export function TourProvider({ children, hasSeenTutorial = false }) {
    const [active, setActive] = useState(() => !hasSeenTutorial);
    const [pageIndex, setPageIndex] = useState(0);

    function nextPage() {
        setPageIndex((prev) => {
            const next = prev + 1;
            if (next >= TOUR_PAGES.length) {
                endTour();
                return prev;
            }
            return next;
        });
    }

    function endTour() {
        setActive(false);
        // Persist to backend
        api.put("/users/me/tutorial").catch(() => { });
        // Also keep localStorage as fallback
        localStorage.setItem("tutorialDone", "1");
    }

    return (
        <TourContext.Provider value={{ active, pageIndex, currentPage: TOUR_PAGES[pageIndex], nextPage, endTour }}>
            {children}
        </TourContext.Provider>
    );
}