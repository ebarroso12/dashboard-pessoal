export const REGISTRY = {
  vidavirtual: { actions: ['summary','notify','health','events'], active: true  },
  openclaw:    { actions: ['summary','notify','health','events'], active: true  },
  crm:         { actions: ['summary','events'],                  active: true  },
  medico:      { actions: [],                                    active: false },
  familiar:    { actions: [],                                    active: false },
};
export const isAppAllowed    = (app)         => app in REGISTRY && REGISTRY[app].active;
export const isActionAllowed = (app, action) => REGISTRY[app]?.actions.includes(action) ?? false;
