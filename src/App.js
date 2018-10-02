import React, { Component } from 'react';
import update from "immutability-helper";
import posed from "react-pose";
import './App.css';

const BehaviorEnum = Object.freeze({
    TriggerLeft: 1,
    TriggerUp: 2,
    TriggerRight: 3,
    TriggerDown: 4,
    TriggerForward: 5,
    TriggerBackward: 6,
    TriggerCounterClockwise: 7,
    TriggerClockwise: 8,
})

function relativeDirectionToAbsolute(fromAbsolute, toRelative){

    // assumes BehaviorEnum absolute directions are 1 to 4 in clockwise order

    // if toRelative is actually an absolute direction, return it unchanged
    if (toRelative < 5 && toRelative > 0) {
        return toRelative;
    }
    // if fromAbsolute is not absolute, return undefined
    else if (fromAbsolute < 1 || fromAbsolute > 4){
        return;
    }

    var result;

    switch (toRelative){
        case BehaviorEnum.TriggerForward:
            result = fromAbsolute;
            break;
        case BehaviorEnum.TriggerBackward:
            result = (fromAbsolute + 2) % 4 || 4;
            break;
        case BehaviorEnum.TriggerClockwise:
            result = (fromAbsolute + 1) % 4 || 4;
            break;
        case BehaviorEnum.TriggerCounterClockwise:
            result = (fromAbsolute + 3) % 4 || 4;
            break;
    }

    return result;
}

function newCellData(){
    return {
        // isPlaying: false,
        timesPlayed: 0,
        mostRecentStepPlayed: -1,
        behaviors: {
            onTriggerByPress: [
                // Math.ceil(Math.random() * BehaviorEnum.TriggerDown)
                BehaviorEnum.TriggerRight,
                // BehaviorEnum.TriggerLeft
            ],
            onTriggerByCell: [
                BehaviorEnum.TriggerClockwise
            ]
        }
    };
}

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {numRows: 5, numCols: 5}
        this.ref = React.createRef();
    }
    render() {
        let onClick = () => {
            let numRows = Math.ceil(Math.random() * 7);
            let numCols = Math.ceil(Math.random() * 7);
            this.setState({numRows, numCols});
        };
        return (
          <div className="App">
            <p>Hello world!</p>
            <Matrix
            width="600px"
            height="600px"
            numRows={this.state.numRows}
            numCols={this.state.numCols}
            hostRef={this.ref}
            />
            <button onClick={onClick}>
                randomize grid size
            </button>
          </div>
        );
    }
}

class Matrix extends Component {

    constructor(props) {
        super(props);

        let _state = {queue: [], isPlaying: false, tempo: 100, step: -1};
        for (let i = 0; i < this.props.numRows * this.props.numCols; i++){
            _state[i] = newCellData();
        }
        this.state = _state;
        this.handleCellPress = this.handleCellPress.bind(this);
        // this.playStep = this.playStep.bind(this);
        this.toggleTimer = this.toggleTimer.bind(this);
        this.setTempoFromForm = this.setTempoFromForm.bind(this);
        this.cellPressHandlers = {};
    }

    componentWillUnmount() {
        this.stopTimer();
    }

    setTimer(tempo) {
        if (! tempo){
            return;
        }
        this.timerID = setInterval(() => this.setState(this.playStep), (6 / tempo) * 2500);
    }

    clearTimer(){
        clearInterval(this.timerID);
    }

    startTimer() {
        if (this.state.isPlaying){
            return false;
        }

        this.setTimer(this.state.tempo);
        this.setState({isPlaying: true});

        return true;
    }

    stopTimer() {
        this.clearTimer();
        this.setState({isPlaying: false});
    }

    toggleTimer() {
        if (! this.startTimer()){
            this.stopTimer();
        }
    }

    setTempoFromForm(e) {
        let tempo = parseFloat(e.target.value);
        if (isNaN(tempo)){
            return;
        }

        this.setState((prevState) => {
            // we have to clear and set the intervals directly instead of using
            // startTimer or stopTimer, since those wrappers rely on potentially
            // outdated state
            this.clearTimer();

            if (prevState.isPlaying){
                this.setTimer(tempo);
            }

            return {tempo}
        });
    }

    handleCellPress(index){
        // let index = (cell.props.row * this.props.numCols) + cell.props.col;

        this.setState((prevState) => {
            return update(prevState, {
                queue: {$push: [{triggeredByIndex: -1, index}]}
            });
        });
    }

    playStep(prevState){
        let newState = {};
        let newQueue = [];
        let cellsToSetActive = {};
        newState.step = prevState.step + 1;

        for (let k in prevState.queue){
            let index = prevState.queue[k].index;
            let triggeredByIndex = prevState.queue[k].triggeredByIndex;

            let prevCellState = prevState[index];
            let behaviors = prevCellState.behaviors[(triggeredByIndex < 0) ? "onTriggerByPress" : "onTriggerByCell"];

            for (let i in behaviors){
                let cellToQueue = -1;

                // if triggered by a press, relative directions are
                // meaningless, so use behavior as is. if triggered by
                // another cell, and the behavior to respond with is a
                // relative direction, convert that to an absolute direction

                let absoluteBehavior = (triggeredByIndex < 0) ? behaviors[i] :
                                       relativeDirectionToAbsolute(prevState.queue[k].triggeredByDirection, behaviors[i]);

                // determine which neighbours, if any, should be triggered
                // on the next cycle

                switch (absoluteBehavior){
                    case BehaviorEnum.TriggerLeft:
                        cellToQueue = (index % this.props.numCols) ? index - 1 : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerRight:
                        cellToQueue = (index % this.props.numCols !== this.props.numCols - 1) ? index + 1 : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerUp:
                        cellToQueue = (index >= this.props.numCols) ? index - this.props.numCols : cellToQueue;
                        break;
                    case BehaviorEnum.TriggerDown:
                        cellToQueue = (index < (this.props.numRows - 1) * this.props.numCols) ? index + this.props.numCols : cellToQueue;
                        break;
                }

                if (cellToQueue >= 0){
                    newQueue.push({index: cellToQueue, triggeredByIndex: index, triggeredByDirection: absoluteBehavior});
                }
            }

            cellsToSetActive[index] = true;
        }

        for (let i = 0; i < this.props.numRows * this.props.numCols; i++){

            let prevCellState = prevState[i];

            if (! prevCellState){
                prevState[i] = newCellData();
            }
            else if (cellsToSetActive[i]) {
                newState[i] = update(prevCellState, {
                    timesPlayed: {$apply: (x) => x + 1},
                    mostRecentStepPlayed: {$set: newState.step}
                });
            }
        }

        newState.queue = newQueue;
        return newState;
    }

    render() {

        let cells = [];
        let sizeWithPadding = 100 / Math.max(this.props.numCols, this.props.numRows);
        let size = .80 * sizeWithPadding;
        let diff = (this.props.numCols - this.props.numRows) * sizeWithPadding;

        // create list of <Cell>'s
        for (let i = 0; i < this.props.numRows * this.props.numCols; i++){
            let cellState = this.state[i] || newCellData();
            let cellIsActive = cellState.timesPlayed && (cellState.mostRecentStepPlayed === this.state.step);
            let col = i % this.props.numCols;
            let row = Math.floor(i / this.props.numCols);

            let x = (col * sizeWithPadding) + .5 * (sizeWithPadding - size);
            let y = (row * sizeWithPadding) + .5 * (sizeWithPadding - size);

            // vertically center grid if there are more columns than rows
            if (diff > 0){
                y += diff / 2;
            }
            // horizontally center grid if there are more rows than columns
            else if (diff < 0){
                x += diff / -2;
            }

            let pressHandler = this.cellPressHandlers[i];
            if (! pressHandler){
                pressHandler = (e) => {
                    if (e.button !== 0){
                        return;
                    }
                    this.handleCellPress(i);
                }

                this.cellPressHandlers[i] = pressHandler;
            }

            // poseKey allows "active" pose to be retriggered whenever the
            // number of times this cell has played goes up
            let props = {
                key: `${row}-${col}`,
                x: `${x}%`,
                y: `${y}%`,
                width: `${size}%`,
                height: `${size}%`,
                pose: (cellIsActive) ? "active" : "inactive",
                poseKey: cellState.timesPlayed % 2,
                fillActive: "#aaff70", // MAGIC VALUE
                fillInactive: "#3333ff", // MAGIC VALUE
                onMouseDown: pressHandler,
            };

            cells.push(<Cell {...props} />);
        }


        return (
            <div>
                <svg className="Matrix" width={this.props.width} height={this.props.height}>
                    { cells }
                </svg>
                <br/>
                <button onClick={() => this.setState(this.playStep)}>next step</button>
                <button onClick={this.toggleTimer}>
                    {(this.state.isPlaying) ? "stop" : "start"}
                </button>
                <input type="text" value={this.state.tempo} onChange={this.setTempoFromForm}/>
            </div>
        )
    }
}

const Cell = posed.rect({
    inactive: {
        fill: ({fillInactive}) => fillInactive,
    },
    active: {
        fill: ({fillActive}) => fillActive,
        transition: ({from, to, fillInactive}) => ({
            type: "keyframes",
            duration: 450, // MAGIC VALUE
            values: [fillInactive, to, fillInactive],
        }),
    },
    props: {fillActive: "#fff", fillInactive: "#000"}
});

export default App;
