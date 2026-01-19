async function run() {
  const { calculatePayments } = await import("../lib/scoring.js");

  const config = {
    bets: {
      holeWinner: 10,
      medal: 0,
      match: 0,
      sandyPar: 0,
      birdie: 0,
      eagle: 0,
      albatross: 0,
      holeOut: 0,
      wetPar: 0,
      ohYes: 0,
    },
  };

  const round = { holes: 3 };
  const playerA = { _id: "Hector", handicap: 20 };
  const playerB = { _id: "Daniel F", handicap: 9 };
  const playerC = { _id: "Daniel G", handicap: 11 };
  const playerD = { _id: "Jorge", handicap: 22 };

  const scorecards = [
    {
      player: playerA,
      holes: [
        { hole: 6, strokes: 6 },
        { hole: 2, strokes: 6 },
        { hole: 3, strokes: 6 },
      ],
    },
    {
      player: playerB,
      holes: [
        { hole: 6, strokes: 4 },
        { hole: 2, strokes: 5 },
        { hole: 3, strokes: 5 },
      ],
    },
    {
      player: playerC,
      holes: [
        { hole: 6, strokes: 6 },
        { hole: 2, strokes: 5 },
        { hole: 3, strokes: 5 },
      ],
    },
    {
      player: playerD,
      holes: [
        { hole: 6, strokes: 7 },
        { hole: 2, strokes: 5 },
        { hole: 3, strokes: 5 },
      ],
    },
  ];

  const holeHandicapsByPlayer = {
    A: [
      { hole: 1, handicap: 1, par: 4 },
      { hole: 2, handicap: 10, par: 4 },
      { hole: 3, handicap: 18, par: 3 },
    ],
    B: [
      { hole: 1, handicap: 1, par: 4 },
      { hole: 2, handicap: 10, par: 4 },
      { hole: 3, handicap: 18, par: 3 },
    ],
  };

  const payments = calculatePayments({
    config,
    round,
    scorecards,
    holeHandicapsByPlayer,
  });

  const holeWinners = payments.filter((p) => p.item === "holeWinner");
  console.log(holeWinners)
  console.assert(holeWinners.length === 2, "Expected 2 hole winners");
  console.assert(
    holeWinners.every((p) => p.to === "A"),
    "Expected player A to win holes 2 and 3"
  );
  console.log("scoringExample ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
