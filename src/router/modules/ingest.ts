const Layout = () => import("@/layout/index.vue");

export default {
  path: "/ingest",
  name: "Ingest",
  component: Layout,
  redirect: "/ingest/failures",
  meta: {
    icon: "ep/warning-filled",
    title: "入库失败",
    rank: 3
  },
  children: [
    {
      path: "/ingest/failures",
      name: "IngestFailures",
      component: () => import("@/views/ingest/failures.vue"),
      meta: {
        title: "失败列表",
        keepAlive: true
      }
    }
  ]
} satisfies RouteConfigsTable;
