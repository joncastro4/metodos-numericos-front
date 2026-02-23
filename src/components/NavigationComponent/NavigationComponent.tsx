import * as React from 'react';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import FunctionsRoundedIcon from '@mui/icons-material/FunctionsRounded';
import SsidChartRoundedIcon from '@mui/icons-material/SsidChartRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import Paper from '@mui/material/Paper';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

export default function SimpleBottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determinar el valor actual basado en la ruta
  const getValueFromPath = (path: string) => {
    switch (path) {
      case '/': return 0;
      case '/heun': return 1;
      case '/runge-kutta': return 2;
      case '/newton-raphson': return 3;
      default: return 0;
    }
  };

  const [value, setValue] = React.useState(getValueFromPath(location.pathname));

  React.useEffect(() => {
    setValue(getValueFromPath(location.pathname));
  }, [location.pathname]);

  return (
    <>
      {/* Aquí se renderizan las rutas hijas */}
      <div style={{ paddingBottom: '56px' }}>
        <Outlet />
      </div>
      
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={value}
          onChange={(event, newValue) => {
            setValue(newValue);
            switch (newValue) {
              case 0:
                navigate('/');
                break;
              case 1:
                navigate('/heun');
                break;
              case 2:
                navigate('/runge-kutta');
                break;
              case 3:
                navigate('/newton-raphson');
                break;
            }
          }}
        >
          <BottomNavigationAction label="Home" icon={<HomeRoundedIcon />}/>
          <BottomNavigationAction label="Euler Mejorado" icon={<CalculateRoundedIcon />}/>
          <BottomNavigationAction label="Runge-Kutta" icon={<FunctionsRoundedIcon />} />
          <BottomNavigationAction label="Newton-Raphson" icon={<SsidChartRoundedIcon />} />
        </BottomNavigation>
      </Paper>
    </>
  );
}