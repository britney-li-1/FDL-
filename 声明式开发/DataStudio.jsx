import React, { useState } from 'react';
import { Layout, Tree, Button, Select, Tabs, Table, Tag, Space, Descriptions, Divider, message } from 'antd';
import { 
  DatabaseOutlined, // 注册表图标
  CodeOutlined,     // 开发表图标
  EditOutlined, 
  PlayCircleOutlined,
  SaveOutlined,
  SyncOutlined,
  FolderOpenOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;

// ========== Mock 数据字典 ==========
const MOCK_SCHEMA_DATA = [
  { key: '1', column: 'id', type: 'BIGINT', comment: '主键ID' },
  { key: '2', column: 'user_id', type: 'VARCHAR', comment: '用户编码' },
  { key: '3', column: 'create_time', type: 'TIMESTAMP', comment: '创建时间' },
];

const MOCK_TREE_DATA = [
  {
    title: '交易业务域',
    key: 'folder_1',
    icon: <FolderOpenOutlined />,
    children: [
      { 
        title: 'ods_order_info', 
        name: '订单原始注册表',
        key: 'ods_001', 
        type: 'REGISTERED', 
        icon: <DatabaseOutlined style={{ color: '#1677ff' }}/>, // 蓝色代表只读资产
        desc: '从 MySQL 实时同步的原始订单表'
      },
      { 
        title: 'dwd_order_fact', 
        name: '订单明细事实表',
        key: 'dwd_001', 
        type: 'DEVELOPED', 
        icon: <CodeOutlined style={{ color: '#52c41a' }}/>, // 绿色代表可开发计算产物
        desc: '清洗关联后的高价值订单数据'
      }
    ],
  },
];

// ========== 主组件 ==========
export default function DataStudio() {
  const [activeTable, setActiveTable] = useState(null);
  // 核心状态机：'PROFILE' (表详情阅读态) | 'EDIT' (代码编辑态)
  const [workspaceMode, setWorkspaceMode] = useState('PROFILE');

  // 当点击左侧树节点时
  const onSelectNode = (selectedKeys, e) => {
    const node = e.node;
    if (node.type) { // 如果选中的是表（而非文件夹）
      setActiveTable(node);
      // ！！！防呆隔离：不管之前在干嘛，点开新表默认一定是“阅读/详情模式”！！！
      setWorkspaceMode('PROFILE');
    }
  };

  // 左侧面板渲染
  const renderSidebar = () => (
    <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <Select defaultValue="dev" style={{ width: '100%', marginBottom: 12 }}>
          <Select.Option value="dev">开发环境 (Dev)</Select.Option>
          <Select.Option value="prod">生产环境 (Prod)</Select.Option>
        </Select>
        <Button type="primary" block icon={<PlusOutlined />}>
          新建开发表 (Logic Table)
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {/* Antd 树组件支持 titleRender 来深度定制图标和标签 */}
        <Tree
          showIcon
          defaultExpandAll
          treeData={MOCK_TREE_DATA}
          onSelect={onSelectNode}
          titleRender={(node) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: '13px' }}>{node.title}</span>
              {node.type === 'REGISTERED' && <Tag bordered={false} color="blue" style={{ transform: 'scale(0.8)', margin: 0 }}>[注册]</Tag>}
              {node.type === 'DEVELOPED' && <Tag bordered={false} color="green" style={{ transform: 'scale(0.8)', margin: 0 }}>[开发]</Tag>}
            </div>
          )}
        />
      </div>
    </Sider>
  );

  // 右侧全局 Header 渲染（动态变化）
  const renderWorkspaceHeader = () => {
    if (!activeTable) return null;

    const isDeveloped = activeTable.type === 'DEVELOPED';
    const isEditing = workspaceMode === 'EDIT';

    return (
      <div style={{ padding: '20px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 左侧：表信息 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>{activeTable.title}</span>
            {isDeveloped ? <Tag color="success">开发表</Tag> : <Tag color="processing">注册表 (只读)</Tag>}
            {isEditing && <Tag color="warning">✏️ 开发草稿中...</Tag>}
          </div>
          <Descriptions size="small" column={3} style={{ color: '#888' }}>
            <Descriptions.Item label="中文名">{activeTable.name}</Descriptions.Item>
            <Descriptions.Item label="负责人">李白</Descriptions.Item>
            <Descriptions.Item label="更新时间">2023-10-25 14:00</Descriptions.Item>
            <Descriptions.Item label="表描述" span={3}>{activeTable.desc}</Descriptions.Item>
          </Descriptions>
        </div>

        {/* 右侧：操作中心 (核心差异点在此渲染) */}
        <Space>
          {activeTable.type === 'REGISTERED' && (
            <>
              <Button icon={<SyncOutlined />}>更新元数据</Button>
              <Button>数据探查</Button>
            </>
          )}

          {activeTable.type === 'DEVELOPED' && workspaceMode === 'PROFILE' && (
            <>
              <Button>调度配置</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={() => setWorkspaceMode('EDIT')}>
                编辑逻辑 (进入开发)
              </Button>
            </>
          )}

          {activeTable.type === 'DEVELOPED' && workspaceMode === 'EDIT' && (
            <>
              <Button onClick={() => setWorkspaceMode('PROFILE')}>退出编辑态</Button>
              <Button type="dashed" icon={<SaveOutlined />}>保存草稿</Button>
              <Button type="primary" icon={<PlayCircleOutlined />} style={{ background: '#52c41a' }}>执行运行</Button>
            </>
          )}
        </Space>
      </div>
    );
  };

  // 右侧工作区 Body 渲染
  const renderWorkspaceBody = () => {
    if (!activeTable) {
      return (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999' }}>
           👈 请在左侧选中一张表查看详情
        </div>
      );
    }

    // 状态 A：默认详情查阅页 (Profile Mode)
    if (workspaceMode === 'PROFILE') {
      const columns = [
        { title: '字段名称', dataIndex: 'column', key: 'column', width: 200, render: (text) => <b>{text}</b> },
        { title: '数据类型', dataIndex: 'type', key: 'type', width: 150, render: (t) => <Tag>{t}</Tag> },
        { title: '字段注释', dataIndex: 'comment', key: 'comment' },
      ];

      return (
        <div style={{ padding: '0 24px', flex: 1, background: '#fff' }}>
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1',
              label: '📇 表结构定义',
              children: <Table dataSource={MOCK_SCHEMA_DATA} columns={columns} pagination={false} size="middle" />
            },
            { key: '2', label: '📊 分区与数据预览', children: <div style={{ padding: 20, color:'#888' }}>[展现前 100 条 Sample Data]</div> },
            { key: '3', label: '🕸 产品血缘', children: <div style={{ padding: 20, color:'#888' }}>[展示上游和下游依赖 DAG 图]</div> }
          ]} />
        </div>
      );
    }

    // 状态 B：进入开发代码编辑器 (Edit Mode)
    if (workspaceMode === 'EDIT') {
      return (
        <div style={{ flex: 1, padding: '24px', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>撰写数据计算逻辑 (SQL):</div>
          {/* 这里未来接入 Monaco Editor */}
          <textarea 
            style={{ 
              flex: 1, width: '100%', padding: '16px', fontFamily: 'monospace', 
              fontSize: '14px', border: '1px solid #d9d9d9', borderRadius: '6px',
              background: '#1e1e1e', color: '#ce9178', resize: 'none'
            }}
            defaultValue={`-- 这里编写 FDL 逻辑表加工代码\nSELECT \n  id,\n  user_id,\n  create_time\nFROM trade_db.ods_order_info\nWHERE ds = '\${ds}';`}
          />
        </div>
      );
    }
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', background: '#fff' }}>
      {renderSidebar()}
      <Layout>
        {renderWorkspaceHeader()}
        {renderWorkspaceBody()}
      </Layout>
    </Layout>
  );
}