import { Outlet } from "react-router";
import PublicHeader from "../header/PublicHeader";

export default function PublicLayout(){
    return(
        <div>
            <PublicHeader/>
            <Outlet/>
        </div>
    )
    
}