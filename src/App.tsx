import { useState } from 'react';
import Navigation from './components/common/Navigation';
import Home from './pages/Home';
import BookEntry from './pages/BookEntry';
import Library from './pages/Library';
import Export from './pages/Export';
import Settings from './pages/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'scan':
        return <BookEntry onBack={() => setCurrentPage('home')} />;
      case 'library':
        return <Library />; // ← CHANGE THIS LINE
      case 'export':
        return <Export />;
      case 'settings':
        return <Settings />;
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