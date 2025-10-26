import React from 'react';
import { useStore } from './store';
import './index.css';

const App: React.FC = () => {
  const {
    tabs,
    activeTabId,
    isSettingsOpen,
    bareUrl,
    addTab,
    removeTab,
    setActiveTab,
    setSettingsOpen,
    setBareUrl,
  } = useStore();

  const [urlInput, setUrlInput] = React.useState('');

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput) {
      addTab(urlInput);
      setUrlInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Tabs */}
      <div className="flex bg-gray-800">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center p-2 cursor-pointer ${
              tab.id === activeTabId ? 'bg-gray-700' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.title}</span>
            <button
              className="ml-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
            >
              x
            </button>
          </div>
        ))}
        <button className="p-2" onClick={() => addTab('https://duckduckgo.com')}>
          +
        </button>
      </div>

      {/* URL Bar */}
      <div className="flex items-center p-2 bg-gray-800">
        <form onSubmit={handleUrlSubmit} className="flex-grow">
          <input
            type="text"
            className="w-full p-1 bg-gray-700 text-white"
            placeholder="Enter URL or search"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </form>
        <button className="p-2" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow relative">
        {tabs.map((tab) => (
          <iframe
            key={tab.id}
            src={`/uv/index.html#${btoa(tab.url)}`}
            className={`absolute w-full h-full ${
              tab.id === activeTabId ? '' : 'hidden'
            }`}
          />
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <h1 className="text-2xl">Welcome to GammaRay!</h1>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl mb-4">Settings</h2>
            <label>
              Bare Server URL:
              <input
                type="text"
                className="w-full p-1 bg-gray-700 text-white mt-1"
                value={bareUrl}
                onChange={(e) => setBareUrl(e.target.value)}
              />
            </label>
            <button
              className="mt-4 p-2 bg-gray-700"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
