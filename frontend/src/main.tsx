import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider 
      locale={zhCN} 
      theme={{ 
        token: { 
          colorPrimary: '#3730a3', 
          borderRadius: 8,
          fontFamily: '"Outfit", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          colorBgLayout: '#f4f5f7',
          colorTextBase: '#1f2937',
          colorInfo: '#3730a3'
        },
        components: {
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475569',
            rowHoverBg: '#f1f5f9',
            headerBorderRadius: 8
          },
          Card: {
            boxShadowTertiary: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)'
          },
          Button: {
            fontWeight: 500,
            controlHeight: 36
          },
          Input: {
            controlHeight: 36
          },
          Select: {
            controlHeight: 36
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
