const LANDING_ROUTES = {
  "#start": { page: "start" },
  "#example/resume": { page: "example", situation: "resume" },
  "#example/portfolio": { page: "example", situation: "portfolio" },
  "#example/interview": { page: "example", situation: "interview" },
  "#example/unsure": { page: "example", situation: "unsure" },
  "#method/1": { page: "method", step: 1 },
  "#method/2": { page: "method", step: 2 },
  "#method/3": { page: "method", step: 3 },
  "#offer": { page: "offer" },
  "#contact": { page: "contact" },
};

export function parseLandingRoute(hash) {
  if (typeof hash !== "string" || !Object.hasOwn(LANDING_ROUTES, hash)) {
    return { page: "start" };
  }
  return { ...LANDING_ROUTES[hash] };
}

export function getPreviousLandingRoute(route) {
  if (route.page === "method" && route.step === 2) return "#method/1";
  if (route.page === "method" && route.step === 3) return "#method/2";
  if (route.page === "offer") return "#method/3";
  if (route.page === "contact") return "#offer";
  return "#start";
}
