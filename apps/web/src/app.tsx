import React from 'react';
import { Dashboard } from './pages/dashboard';
import './styles/globals.css';

export const App: React.FC = () => {
  return (
    <div className="app">
      <Dashboard />
    </div>
  );
};