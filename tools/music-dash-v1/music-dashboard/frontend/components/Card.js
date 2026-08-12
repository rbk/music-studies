// Card: a titled panel. Pass `title`, optional `wide`, and children.

function Card({ title, wide, children, right }) {
    return (
        <div className={"card" + (wide ? " col-wide" : "")}>
            <div className="row between" style={{ marginBottom: "0.3rem" }}>
                <h2 style={{ margin: 0 }}>{title}</h2>
                {right}
            </div>
            {children}
        </div>
    );
}

window.Card = Card;