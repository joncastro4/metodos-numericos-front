import { createBrowserRouter } from "react-router-dom";
import RungeKuttaComponent from "./components/RungeKuttaComponent/RungeKuttaComponent";
import NewtonRaphsonComponent from "./components/NewtonRaphsonComponent/NewtonRaphsonComponent";
import HeunComponent from "./components/HeunComponent/HeunComponent";
import SimpleBottomNavigation from "./components/NavigationComponent/NavigationComponent";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SimpleBottomNavigation />,
    children: [
      {
        path: "/",
        element: (
          <div style={{
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
          }}>
            <img
              src="/artworks-lhLHnowNyMAYxY2j-VUZWNw-t1080x1080.jpg"
              alt="Reisa"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                display: 'block',
              }}
            />
          </div>
        ),
      },
      {
        path: "/heun",
        element: <HeunComponent />,
      },
      {
        path: "/runge-kutta",
        element: <RungeKuttaComponent />,
      },
      {
        path: "/newton-raphson",
        element: <NewtonRaphsonComponent />,
      }
    ],
  }
])

export default router;