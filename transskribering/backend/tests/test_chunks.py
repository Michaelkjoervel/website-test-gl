from app.services.audio import plan_chunks


def test_plan_chunks_short_file_one_chunk():
    plan = plan_chunks(60.0, chunk_duration=900, overlap_seconds=3)
    assert len(plan) == 1
    assert plan[0] == (1, 0.0, 60.0)


def test_plan_chunks_long_file_correct_order():
    plan = plan_chunks(2 * 60 * 60, chunk_duration=900, overlap_seconds=3)
    # Numrene skal være fortløbende og dække hele varigheden
    numbers = [c[0] for c in plan]
    assert numbers == sorted(numbers)
    assert plan[0][1] == 0.0
    assert plan[-1][2] >= 2 * 60 * 60 - 1
    # Overlap: hver chunk efter den første skal starte før forrige slutter
    for prev, nxt in zip(plan, plan[1:]):
        assert nxt[1] < prev[2]
