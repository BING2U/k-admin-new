const Layout = () => import("@/layout/index.vue");

export default {
  path: "/artists",
  name: "Artists",
  component: Layout,
  redirect: "/artists/index",
  meta: {
    icon: "ep/avatar",
    title: "艺人核对",
    rank: 1
  },
  children: [
    {
      path: "/artists/index",
      name: "ArtistList",
      component: () => import("@/views/artists/index.vue"),
      meta: {
        title: "艺人列表",
        keepAlive: true
      }
    },
    {
      path: "/artists/:id",
      name: "ArtistDetail",
      component: () => import("@/views/artists/detail.vue"),
      meta: {
        title: "艺人详情",
        showLink: false,
        activePath: "/artists/index"
      }
    }
  ]
} satisfies RouteConfigsTable;
