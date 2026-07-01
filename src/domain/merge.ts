import type { Marker } from "../types";

export function replaceParticipantMarkers(
  masterMarkers: Marker[],
  draftMarkers: Marker[],
  participantId: string,
  competitionId: string
): Marker[] {
  const retained = masterMarkers.filter(
    (marker) => marker.participantId !== participantId || marker.competitionId !== competitionId
  );
  const replacements = draftMarkers.filter(
    (marker) => marker.participantId === participantId && marker.competitionId === competitionId
  );

  return [...retained, ...replacements];
}
