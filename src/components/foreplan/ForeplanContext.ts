import { differenceInWeeks } from "date-fns";
import { reduce, size, toInteger } from "lodash";
import { FC, useEffect } from "react";
import { createHook, createStore } from "react-sweet-state";
import { useDebounce, useUpdateEffect } from "react-use";

import { LAST_TIME_USED, StateCourse } from "../../../constants";
import { ICourse } from "../../../interfaces";
import { useUser } from "../../utils/useUser";

export interface IForeplanData {
  active: boolean;
  foreplanCourses: Record<string, boolean>;
  foreplanCoursesData: Record<string, Pick<ICourse, "credits" | "name">>;
  totalCreditsTaken: number;
  advices: Record<
    string,
    {
      titleText: string;
      paragraphText: string;
      failRate: {
        low: number;
        mid: number;
        high: number;
      };
    }
  >;
}

const emptyObject = {};

const rememberForeplanDataKey = "TrAC_foreplan_data";

const initForeplanData = (initialData = defaultForeplanData): IForeplanData => {
  try {
    const rememberedData = localStorage.getItem(rememberForeplanDataKey);
    if (!rememberedData) return initialData;
    return { ...initialData, ...JSON.parse(rememberedData) };
  } catch (err) {
    return initialData;
  }
};

const defaultForeplanData: IForeplanData = {
  active: false,
  foreplanCourses: emptyObject,
  foreplanCoursesData: emptyObject,
  totalCreditsTaken: 0,
  advices: emptyObject,
};

const ForeplanStore = createStore({
  initialState: initForeplanData(),
  actions: {
    activateForeplan: () => ({ setState }) => {
      setState({
        active: true,
      });
    },
    disableForeplan: () => ({ setState }) => {
      setState({
        active: false,
      });
    },
    addCourseForeplan: (
      course: string,
      data: IForeplanData["foreplanCoursesData"][string]
    ) => ({ setState, getState }) => {
      const { foreplanCourses, foreplanCoursesData } = getState();

      const newForeplanCourses = { ...foreplanCourses, [course]: true };
      const newForeplanCoursesData = { ...foreplanCoursesData, [course]: data };
      const totalCreditsTaken = reduce(
        newForeplanCoursesData,
        (acum, { credits }) => {
          return acum + credits?.[0]?.value ?? 0;
        },
        0
      );

      setState({
        foreplanCourses: newForeplanCourses,
        foreplanCoursesData: newForeplanCoursesData,
        totalCreditsTaken,
      });
    },
    removeCourseForeplan: (course: string) => ({ setState, getState }) => {
      const {
        foreplanCourses: { [course]: deletedCourse, ...foreplanCourses },
        foreplanCoursesData: {
          [course]: deletedCourseData,
          ...foreplanCoursesData
        },
      } = getState();
      const totalCreditsTaken = reduce(
        foreplanCoursesData,
        (acum, { credits }) => {
          return acum + credits?.[0]?.value ?? 0;
        },
        0
      );
      setState({
        foreplanCourses,
        foreplanCoursesData,
        totalCreditsTaken,
      });
    },
    setForeplanAdvices: (advices: IForeplanData["advices"]) => ({
      setState,
    }) => {
      setState({
        advices,
      });
    },
    reset: () => ({ setState }) => {
      setState(defaultForeplanData);
    },
  },
  name: "ForeplanContext",
});

export const useForeplanData = createHook(ForeplanStore);

export const useIsForeplanCourseChecked = createHook(ForeplanStore, {
  selector: ({ foreplanCourses }, { code }: { code: string }) => {
    return !!foreplanCourses[code];
  },
});

export const useForeplanCourses = createHook(ForeplanStore, {
  selector: ({ foreplanCourses }) => {
    return foreplanCourses;
  },
});

export const useForeplanTotalCreditsTaken = createHook(ForeplanStore, {
  selector: ({ totalCreditsTaken }) => {
    return totalCreditsTaken;
  },
});

export const useForeplanCoursesSize = createHook(ForeplanStore, {
  selector: ({ foreplanCourses }) => {
    return size(foreplanCourses);
  },
});

export const useAnyForeplanCourses = createHook(ForeplanStore, {
  selector: ({ foreplanCourses }) => {
    return size(foreplanCourses) > 0;
  },
});

export const useIsForeplanActive = createHook(ForeplanStore, {
  selector: ({ active }) => {
    return active;
  },
});

export const useForeplanCourseData = createHook(ForeplanStore, {
  selector: ({ foreplanCoursesData }, { code }: { code: string }) => {
    return foreplanCoursesData[code];
  },
});

export const useIsPossibleToTakeForeplan = createHook(ForeplanStore, {
  selector: ({ active }, { state }: { state: StateCourse | undefined }) => {
    if (active) {
      switch (state) {
        case undefined:
        case StateCourse.Failed:
        case StateCourse.Canceled: {
          return true;
        }
        default:
      }
    }
    return false;
  },
});

export const useForeplanAdvice = createHook(ForeplanStore, {
  selector: ({ advices, totalCreditsTaken }) => {
    let load: "high" | "mid" | "low";
    if (totalCreditsTaken <= 12) {
      load = "low";
    } else if (totalCreditsTaken <= 25) {
      load = "mid";
    } else {
      load = "high";
    }
    return advices[load] || emptyObject;
  },
});

export const ForeplanContextManager: FC<{ distinct?: string }> = ({
  distinct,
}) => {
  const [
    state,
    { reset, disableForeplan, setForeplanAdvices },
  ] = useForeplanData();

  const { user } = useUser({
    fetchPolicy: "cache-only",
  });

  useEffect(() => {
    //TODO: Use real data
    setForeplanAdvices({
      low: {
        titleText: "Tu carga de estudio es baja",
        paragraphText:
          "Sólo un <Low /> de estudiantes en años anteriores que" +
          " han tomado una carga similar han pasado todos los cursos. " +
          "Un <Mid /> de ellos han reprobado 1 curso, y <High /> han reprobado más de uno",
        failRate: {
          low: 85,
          mid: 10,
          high: 5,
        },
      },
      mid: {
        titleText: "Tu carga de estudio es media",
        paragraphText:
          "Sólo un <Low /> de estudiantes en años anteriores que" +
          " han tomado una carga similar han pasado todos los cursos. " +
          "Un <Mid /> de ellos han reprobado 1 curso, y <High /> han reprobado más de uno",
        failRate: {
          low: 55,
          mid: 30,
          high: 15,
        },
      },
      high: {
        titleText: "¡Tu carga de estudio es alta!",
        paragraphText:
          "Sólo un <Low /> de estudiantes en años anteriores que" +
          " han tomado una carga similar han pasado todos los cursos. " +
          "Un <Mid /> de ellos han reprobado 1 curso, y <High /> han reprobado más de uno",
        failRate: {
          low: 5,
          mid: 20,
          high: 75,
        },
      },
    });
  }, [setForeplanAdvices]);

  useEffect(() => {
    if (state.active && !user?.config.FOREPLAN) {
      disableForeplan();
    }
  }, [user, state.active, disableForeplan]);

  useEffect(() => {
    try {
      const lastTimeUsed = localStorage.getItem(LAST_TIME_USED);
      if (lastTimeUsed) {
        if (differenceInWeeks(toInteger(lastTimeUsed), Date.now()) >= 2) {
          reset();
        }
      }
      localStorage.setItem(LAST_TIME_USED, Date.now().toString());
    } catch (err) {}
  }, [reset]);

  useUpdateEffect(() => {
    if (distinct) {
      reset();
    }
  }, [distinct, reset]);

  useDebounce(
    () => {
      try {
        if (user?.config.FOREPLAN)
          localStorage.setItem(rememberForeplanDataKey, JSON.stringify(state));
      } catch (err) {}
    },
    5000,
    [state]
  );

  return null;
};
