import { App as AntApp, Layout } from 'antd';
import { Link, Route, Routes } from 'react-router-dom';
import { BuilderRoute } from './builder/BuilderPage';
import { FillPage } from './pages/FillPage';
import { HomePage } from './pages/HomePage';
import { ResponsesPage } from './pages/ResponsesPage';

const { Header, Content } = Layout;

export function App() {
  return (
    <AntApp>
      <Layout style={{ minHeight: '100%' }}>
        <Header style={{ borderBottom: '1px solid #eceef5', display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontWeight: 600, fontSize: 18 }}>
            Form Builder
          </Link>
        </Header>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/builder/:templateId" element={<BuilderRoute />} />
            <Route path="/templates/:templateId/responses" element={<ResponsesPage />} />
            <Route path="/fill/:instanceId" element={<FillPage />} />
          </Routes>
        </Content>
      </Layout>
    </AntApp>
  );
}
