import { BrowserRouter } from "react-router";
import AppRouter from "./AppRouter";
import { I18nProvider } from "../i18n";

function App() {

  return (
    <I18nProvider><BrowserRouter>
    <AppRouter />
    </BrowserRouter></I18nProvider>
  );
}

export default App;
