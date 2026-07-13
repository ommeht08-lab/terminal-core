def generate_hybrid_signal(z_score: float, fundamental_score: float) -> str:
    if z_score <= -2.0 and fundamental_score >= 70:
        return "Oversold Opportunity (Mean Reversion)"
    if z_score <= -2.0 and fundamental_score < 40:
        return "Fundamental Breakdown (Value Trap)"
    if z_score >= 2.0 and fundamental_score >= 70:
        return "Overbought but High Quality (Hold/Trim)"
    if z_score >= 2.0 and fundamental_score < 40:
        return "Overvalued Junk (Strong Sell)"
    return "Neutral / Fairly Valued"
