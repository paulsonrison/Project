import { Outlet, useLocation } from "react-router";
import Navigation from "../navigation/Navigation";
import PageHeader from "../header/PageHeader";

export default function AppLayout() {
    const location = useLocation();
    return (
        <div className="flex flex-row">
            <div className="w-[12%]">
                <Navigation />
            </div>
            <div className="w-screen">
                <PageHeader title={location.pathname.slice(1).replaceAll("-", " ")} />
                <Outlet />
            </div>
        </div>
    );
}