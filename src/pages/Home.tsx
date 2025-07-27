import { Plus, BookOpen, TrendingUp } from 'lucide-react';

const Home = () => {
  return (
    <div className="p-4 pb-20">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Book Lister
        </h1>
        <p className="text-gray-600">
          Streamline your Vinted book listings
        </p>
      </header>

      <div className="grid gap-4 mb-8">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-teal-900">Quick Start</h3>
              <p className="text-sm text-teal-700">Scan a book to get started</p>
            </div>
            <Plus className="text-teal-600" size={32} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <BookOpen className="text-blue-500 mb-2" size={24} />
            <h4 className="font-medium text-gray-900">Books Listed</h4>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <TrendingUp className="text-green-500 mb-2" size={24} />
            <h4 className="font-medium text-gray-900">This Week</h4>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p>No books added yet</p>
          <p className="text-sm">Tap the scan button to add your first book!</p>
        </div>
      </div>
    </div>
  );
};

export default Home;