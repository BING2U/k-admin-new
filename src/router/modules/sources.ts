const Layout = () => import("@/layout/index.vue");

export default {
  path: "/sources",
  name: "Sources",
  component: Layout,
  redirect: "/sources/index",
  meta: {
    icon: "ep/connection",
    title: "数据源",
    rank: 2
  },
  children: [
    {
      path: "/sources/index",
      name: "SourceConfig",
      component: () => import("@/views/sources/index.vue"),
      meta: {
        title: "数据源配置",
        keepAlive: true
      }
    }
  ]
} satisfies RouteConfigsTable;
