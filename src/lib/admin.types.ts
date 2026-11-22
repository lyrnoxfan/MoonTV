export interface AdminConfig {
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    ImageProxy: string;
    DoubanProxy: string;
    DisableYellowFilter: boolean;
  };
  UserConfig: {
    AllowRegister: boolean;
    Users: {
      username: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
  // 存储后端类型（localstorage / d1 / upstash 等）。仅通过这个已鉴权的
  // 管理员接口返回，不再放进公开的 window.RUNTIME_CONFIG。
  StorageType: string;
}
