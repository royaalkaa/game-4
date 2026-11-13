import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

export function renderRoutes(url: string, routes: { path: string; element: ReactElement }[]) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}
