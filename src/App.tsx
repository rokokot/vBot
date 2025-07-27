import { useState } from 'react';
import Navigation from './components/common/Navigation';
import Home from './pages/Home';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'scan':
        return <div className="p-4 pb-20"><h1 className="text-xl font-bold">Scanner (Coming Soon)</h1></div>;
      case 'library':
        return <div className="p-4 pb-20"><h1 className="text-xl font-bold">Library (Coming Soon)</h1></div>;
      case 'export':
        return <div className="p-4 pb-20"><h1 className="text-xl font-bold">Export (Coming Soon)</h1></div>;
      case 'settings':
        return <div className="p-4 pb-20"><h1 className="text-xl font-bold">Settings (Coming Soon)</h1></div>;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderCurrentPage()}
      <Navigation activeTab={currentPage} onTabChange={setCurrentPage} />
    </div>
  );
}

export default App;