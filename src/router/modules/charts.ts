const Layout = () => import("@/layout/index.vue");

export default {
  path: "/charts",
  name: "Charts",
  component: Layout,
  redirect: "/charts/index",
  meta: {
    icon: "ep/data-line",
    title: "榜单",
    rank: 2
  },
  children: [
    {
      path: "/charts/index",
      name: "ChartAdmin",
      component: () => import("@/views/charts/index.vue"),
      meta: {
        title: "榜单",
        keepAlive: true
      }
    }
  ]
} satisfies RouteConfigsTable;
