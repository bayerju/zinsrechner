import { useState } from "react";
import { Switch } from "./switch";
import { NumberInput } from "./number_input";

export function SwitchInput({
  labelLeft,
  labelRight,
  setLeft,
  setRight,
  unitLeft,
  unitRight,

  // onChange,
  valueLeft,
  valueRight,
  onCheckedChange,
}: {
  labelLeft: string;
  labelRight: string;
  unitLeft?: string;
  unitRight?: string;
  valueLeft: number;
  setLeft: (value: number) => void;
  valueRight: number;
  setRight: (value: number) => void;
  onCheckedChange?: (value: boolean) => void;

  // onChange: (value: number, isRückzahlungsfreieZeit: boolean) => void;
}) {
  // const [checked, setChecked] = useState(value !== 0);
  const [checked, setChecked] = useState(valueLeft !== 0);

  return (
    <div>
      {/* Labels row */}
      <div className="flex flex-row gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">
            {labelLeft} <span title="Info">ⓘ</span>
          </label>
        </div>
        <div className="w-12"></div> {/* Space for switch */}
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">
            {labelRight} <span title="Info">ⓘ</span>
          </label>
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <div className="flex-1">
          <NumberInput
            value={valueLeft}
            onChange={(value) => setLeft(value)}
            disabled={checked}
            unit={unitLeft}
          />
        </div>
        <Switch
          className="data-[state=checked]:bg-input data-[state=unchecked]:bg-input border-neutral-500"
          checked={checked}
          onCheckedChange={(value) => {
            setChecked(value);
            onCheckedChange?.(value);
          }}
          thumbClasses="bg-primary border border-neutral-700 "
        />
        <div className="flex-1">
          <NumberInput
            value={valueRight}
            onChange={(value) => setRight(value)}
            disabled={!checked}
            unit={unitRight}
          />
        </div>
      </div>
    </div>
  );
}

// export function SwitchInput({
//   onCheckedChange,
//   startChecked,
//   LeftComponent,
//   RightComponent,
// }: {
//   onCheckedChange?: (value: boolean) => void;
//   startChecked?: boolean;
//   LeftComponent: React.ReactNode;
//   RightComponent: React.ReactNode;

//   // onChange: (value: number, isRückzahlungsfreieZeit: boolean) => void;
// }) {
//   // const [checked, setChecked] = useState(value !== 0);
//   const [checked, setChecked] = useState(startChecked);

//   return (
//     <div>
//       <div className="flex flex-row gap-2">
//         {LeftComponent}
//         <Switch
//           checked={checked}
//           onCheckedChange={(value) => {
//             setChecked(value);
//             onCheckedChange?.(value);
//           }}
//         />
//         {RightComponent}
//       </div>
//     </div>
//   );
// }
