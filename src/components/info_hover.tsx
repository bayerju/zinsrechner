import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";


export function InfoHover({ content }: { content: string }) {
  return (
    <HoverCard>
        <HoverCardTrigger>ⓘ</HoverCardTrigger>
        <HoverCardContent>
            <p>{content}</p>
        </HoverCardContent>
    </HoverCard>
  );
}