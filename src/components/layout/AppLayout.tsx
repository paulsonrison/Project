import { Outlet } from "react-router";
import Navigation from "../navigation/Navigation";
import PageHeader from "../header/PageHeader";

export default function AppLayout() {
	return <div><Navigation/>
    <PageHeader title={"Residents"}/>
    <Outlet/>
    </div>;
}