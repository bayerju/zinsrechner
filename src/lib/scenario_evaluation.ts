import {
  calculateFullPaymentTimeFromSollzins,
  calculateImplicitCostsFromEffectiveRate,
  calculateMonthlyRateFromSollzins,
  calculateNettodarlehensbetragBank,
  calculateRestschuldFromSollzins,
  calculateTilgungszuschussBetrag,
} from "~/lib/calculations";
import {
  calculateBridgeMonthlyInterest,
  getCreditEndYear,
  isBridgeCredit,
  type Credit,
} from "~/lib/credit";
import { type ScenarioValues } from "~/state/scenario_values_atom";

export type EvaluationOptions = {
  includeRefinancing: boolean;
  analysisHorizonYears: number;
  opportunityRate: number;
};

export type CreditCashflowSegment = {
  startYear: number;
  endYear: number;
  rate: number;
};

type DebtPayment = {
  year: number;
  amount: number;
};

export type ScenarioEvaluation = {
  presentValueCost: number;
  futureValueCost: number;
  presentValueRates: number;
  presentValueResidualDebt: number;
  initialEquity: number;
  implicitEffectiveRateCosts: number;
  residualDebtAtHorizon: number;
};

export function monthlyRateFromAnnualRate(annualRate: number) {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

export function getRefinancingSegment({
  principal,
  startYear,
  sollzins,
  tilgungssatz,
  horizonYears,
}: {
  principal: number;
  startYear: number;
  sollzins: number;
  tilgungssatz: number;
  horizonYears: number;
}) {
  if (principal <= 0 || startYear >= horizonYears) return null;
  const monthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: principal,
    sollzins,
    tilgungssatz,
  });
  const payoff = calculateFullPaymentTimeFromSollzins({
    darlehensbetrag: principal,
    monthlyRate,
    sollzins,
  });

  return {
    monthlyRate,
    endYear: payoff.canBePaidOff
      ? Math.min(horizonYears, startYear + payoff.yearsAufgerundet)
      : horizonYears,
  };
}

function presentValueAtMonth(
  amount: number,
  month: number,
  monthlyDiscountRate: number,
) {
  if (Math.abs(monthlyDiscountRate) < 1e-12) return amount;
  return amount / Math.pow(1 + monthlyDiscountRate, month);
}

function futureValueAtHorizon(
  amount: number,
  month: number,
  horizonMonths: number,
  monthlyRate: number,
) {
  if (Math.abs(monthlyRate) < 1e-12) return amount;
  return amount * Math.pow(1 + monthlyRate, horizonMonths - month);
}

function presentValueOfSegments(
  segments: CreditCashflowSegment[],
  horizonMonths: number,
  monthlyDiscountRate: number,
) {
  let presentValue = 0;

  for (let month = 1; month <= horizonMonths; month++) {
    const yearAtMonthEnd = month / 12;
    const monthlyRate = segments.reduce((sum, segment) => {
      const active =
        yearAtMonthEnd > segment.startYear && yearAtMonthEnd <= segment.endYear;
      return active ? sum + segment.rate : sum;
    }, 0);
    presentValue += presentValueAtMonth(
      monthlyRate,
      month,
      monthlyDiscountRate,
    );
  }

  return presentValue;
}

function residualDebtAfterRefinancing({
  principal,
  startYear,
  targetYear,
  monthlyRate,
  sollzins,
}: {
  principal: number;
  startYear: number;
  targetYear: number;
  monthlyRate: number;
  sollzins: number;
}) {
  const refinancingYears = Math.max(0, targetYear - startYear);
  if (refinancingYears <= 0) return principal;
  return calculateRestschuldFromSollzins({
    nettodarlehensbetrag: principal,
    monthlyRate,
    sollzins,
    years: refinancingYears,
  });
}

function calculateBankData(values: ScenarioValues, options: EvaluationOptions) {
  const credits = Object.values(values.credits ?? {});
  const principal = calculateNettodarlehensbetragBank({
    kaufpreis: values.kaufpreis,
    modernisierungskosten: values.modernisierungskosten,
    kaufnebenkosten: values.kaufpreis * 0.1207,
    eigenkapital: values.eigenkapital,
    credits,
  });
  const monthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: principal,
    sollzins: values.sollzins,
    tilgungssatz: values.tilgungssatz,
  });
  const restAtBinding = calculateRestschuldFromSollzins({
    nettodarlehensbetrag: principal,
    monthlyRate,
    sollzins: values.sollzins,
    years: values.zinsbindung,
  });
  const segments: CreditCashflowSegment[] = [
    {
      startYear: 0,
      endYear: Math.min(values.zinsbindung, options.analysisHorizonYears),
      rate: monthlyRate,
    },
  ];

  let residualDebtAtHorizon = 0;
  const debtPayments: DebtPayment[] = [];

  if (options.analysisHorizonYears <= values.zinsbindung) {
    residualDebtAtHorizon = calculateRestschuldFromSollzins({
      nettodarlehensbetrag: principal,
      monthlyRate,
      sollzins: values.sollzins,
      years: options.analysisHorizonYears,
    });
    debtPayments.push({
      year: options.analysisHorizonYears,
      amount: residualDebtAtHorizon,
    });
  } else if (!options.includeRefinancing) {
    debtPayments.push({
      year: values.zinsbindung,
      amount: restAtBinding,
    });
  }

  if (options.includeRefinancing) {
    const refinancing = getRefinancingSegment({
      principal: restAtBinding,
      startYear: values.zinsbindung,
      sollzins: values.sollzins,
      tilgungssatz: values.tilgungssatz,
      horizonYears: options.analysisHorizonYears,
    });
    if (refinancing) {
      segments.push({
        startYear: values.zinsbindung,
        endYear: refinancing.endYear,
        rate: refinancing.monthlyRate,
      });
      residualDebtAtHorizon = residualDebtAfterRefinancing({
        principal: restAtBinding,
        startYear: values.zinsbindung,
        targetYear: options.analysisHorizonYears,
        monthlyRate: refinancing.monthlyRate,
        sollzins: values.sollzins,
      });
      debtPayments.push({
        year: options.analysisHorizonYears,
        amount: residualDebtAtHorizon,
      });
    }
  }

  return {
    segments,
    residualDebtAtHorizon,
    debtPayments,
    implicitCosts: calculateImplicitCostsFromEffectiveRate({
      darlehensbetrag: principal,
      monthlyRate,
      restschuld: restAtBinding,
      effectiveRate: values.effzins,
      years: values.zinsbindung,
    }),
  };
}

function calculateCreditData(
  credit: Credit,
  values: ScenarioValues,
  options: EvaluationOptions,
) {
  if (isBridgeCredit(credit)) {
    const endYear = getCreditEndYear(credit);
    const monthlyInterest = calculateBridgeMonthlyInterest(credit);
    const residualDebtAtHorizon =
      options.analysisHorizonYears < endYear ? credit.summeDarlehen : 0;
    return {
      segments: [
        {
          startYear: 0,
          endYear: Math.min(endYear, options.analysisHorizonYears),
          rate: monthlyInterest,
        },
      ],
      residualDebtAtHorizon,
      debtPayments: [
        {
          year: Math.min(endYear, options.analysisHorizonYears),
          amount: credit.summeDarlehen,
        },
      ],
      implicitCosts: calculateImplicitCostsFromEffectiveRate({
        darlehensbetrag: credit.summeDarlehen,
        monthlyRate: monthlyInterest,
        restschuld: credit.summeDarlehen,
        effectiveRate: credit.effektiverZinssatz,
        years: endYear,
      }),
    };
  }

  const tilgungszuschuss = calculateTilgungszuschussBetrag({
    darlehensbetrag: credit.summeDarlehen,
    foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
    tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
  });
  const principal = Math.max(0, credit.summeDarlehen - tilgungszuschuss);
  const creditSollzins = credit.sollzinssatz ?? credit.effektiverZinssatz;
  const monthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: principal,
    sollzins: creditSollzins,
    tilgungssatz: credit.tilgungssatz,
    rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
  });
  const restAtBinding = calculateRestschuldFromSollzins({
    nettodarlehensbetrag: principal,
    monthlyRate,
    sollzins: creditSollzins,
    years: credit.zinsbindung,
    tilgungsfreieZeit: credit.tilgungsFreieZeit,
    rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
  });
  const segments: CreditCashflowSegment[] = credit.rates.map((rate) => ({
    startYear: rate.startYear,
    endYear: Math.min(
      rate.endYear,
      credit.zinsbindung,
      options.analysisHorizonYears,
    ),
    rate: rate.rate,
  }));

  let residualDebtAtHorizon = 0;
  const debtPayments: DebtPayment[] = [];

  if (options.analysisHorizonYears <= credit.zinsbindung) {
    residualDebtAtHorizon = calculateRestschuldFromSollzins({
      nettodarlehensbetrag: principal,
      monthlyRate,
      sollzins: creditSollzins,
      years: options.analysisHorizonYears,
      tilgungsfreieZeit: credit.tilgungsFreieZeit,
      rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
    });
    debtPayments.push({
      year: options.analysisHorizonYears,
      amount: residualDebtAtHorizon,
    });
  } else if (!options.includeRefinancing) {
    debtPayments.push({
      year: credit.zinsbindung,
      amount: restAtBinding,
    });
  }

  if (options.includeRefinancing) {
    const refinancing = getRefinancingSegment({
      principal: restAtBinding,
      startYear: credit.zinsbindung,
      sollzins: values.sollzins,
      tilgungssatz: values.tilgungssatz,
      horizonYears: options.analysisHorizonYears,
    });
    if (refinancing) {
      segments.push({
        startYear: credit.zinsbindung,
        endYear: refinancing.endYear,
        rate: refinancing.monthlyRate,
      });
      residualDebtAtHorizon = residualDebtAfterRefinancing({
        principal: restAtBinding,
        startYear: credit.zinsbindung,
        targetYear: options.analysisHorizonYears,
        monthlyRate: refinancing.monthlyRate,
        sollzins: values.sollzins,
      });
      debtPayments.push({
        year: options.analysisHorizonYears,
        amount: residualDebtAtHorizon,
      });
    }
  }

  return {
    segments,
    residualDebtAtHorizon,
    debtPayments,
    implicitCosts: calculateImplicitCostsFromEffectiveRate({
      darlehensbetrag: principal,
      monthlyRate,
      restschuld: restAtBinding,
      effectiveRate: credit.effektiverZinssatz,
      years: credit.zinsbindung,
    }),
  };
}

export function getCreditCashflowSegments(
  values: ScenarioValues,
  options: EvaluationOptions,
) {
  const bank = calculateBankData(values, options);
  const credits = Object.values(values.credits ?? {}).map((credit) =>
    calculateCreditData(credit, values, options),
  );

  return [bank, ...credits].flatMap((item) => item.segments);
}

export function calculateScenarioImplicitCosts(values: ScenarioValues) {
  const options: EvaluationOptions = {
    includeRefinancing: false,
    analysisHorizonYears: Number.POSITIVE_INFINITY,
    opportunityRate: 0,
  };
  const bank = calculateBankData(values, options);
  const credits = Object.values(values.credits ?? {}).map((credit) =>
    calculateCreditData(credit, values, options),
  );
  return [bank, ...credits].reduce((sum, item) => sum + item.implicitCosts, 0);
}

export function evaluateScenario(
  values: ScenarioValues,
  options: EvaluationOptions,
): ScenarioEvaluation {
  const horizonMonths = Math.max(
    1,
    Math.round(options.analysisHorizonYears * 12),
  );
  const monthlyDiscountRate = monthlyRateFromAnnualRate(
    options.opportunityRate,
  );
  const bank = calculateBankData(values, options);
  const credits = Object.values(values.credits ?? {}).map((credit) =>
    calculateCreditData(credit, values, options),
  );
  const allItems = [bank, ...credits];
  const segments = allItems.flatMap((item) => item.segments);
  const presentValueRates = presentValueOfSegments(
    segments,
    horizonMonths,
    monthlyDiscountRate,
  );
  const residualDebtAtHorizon = allItems.reduce(
    (sum, item) => sum + item.residualDebtAtHorizon,
    0,
  );
  const presentValueResidualDebt = allItems.reduce(
    (sum, item) =>
      sum +
      item.debtPayments.reduce((paymentSum, payment) => {
        if (payment.amount <= 0) return paymentSum;
        return (
          paymentSum +
          presentValueAtMonth(
            payment.amount,
            Math.max(0, Math.round(payment.year * 12)),
            monthlyDiscountRate,
          )
        );
      }, 0),
    0,
  );
  const implicitEffectiveRateCosts = allItems.reduce(
    (sum, item) => sum + item.implicitCosts,
    0,
  );
  const initialEquity = Math.max(0, values.eigenkapital);
  const presentValueCost =
    initialEquity +
    implicitEffectiveRateCosts +
    presentValueRates +
    presentValueResidualDebt;
  const futureValueCost =
    futureValueAtHorizon(
      initialEquity + implicitEffectiveRateCosts,
      0,
      horizonMonths,
      monthlyDiscountRate,
    ) +
    segments.reduce((sum, segment) => {
      let futureValue = 0;
      for (let month = 1; month <= horizonMonths; month++) {
        const yearAtMonthEnd = month / 12;
        const active =
          yearAtMonthEnd > segment.startYear &&
          yearAtMonthEnd <= segment.endYear;
        if (!active) continue;
        futureValue += futureValueAtHorizon(
          segment.rate,
          month,
          horizonMonths,
          monthlyDiscountRate,
        );
      }
      return sum + futureValue;
    }, 0) +
    allItems.reduce(
      (sum, item) =>
        sum +
        item.debtPayments.reduce((paymentSum, payment) => {
          if (payment.amount <= 0) return paymentSum;
          return (
            paymentSum +
            futureValueAtHorizon(
              payment.amount,
              Math.max(0, Math.round(payment.year * 12)),
              horizonMonths,
              monthlyDiscountRate,
            )
          );
        }, 0),
      0,
    );

  return {
    presentValueCost,
    futureValueCost,
    presentValueRates,
    presentValueResidualDebt,
    initialEquity,
    implicitEffectiveRateCosts,
    residualDebtAtHorizon,
  };
}
