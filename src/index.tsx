import React from 'react';
import Box from '@material-ui/core/Box';
import withStyles from '@material-ui/core/styles/withStyles';
import {WithStyles} from '@material-ui/styles';
import CropManager, {CropManagerState} from './CropManager';
import createStore from "@muzikanto/observable/createStore";
import StoreConsumer from "@muzikanto/observable/StoreConsumer";
import CropperSubBarCrop from "./blocks/CropperToolbarTools/CropperToolbarTools";
import CropperToolbar from "./blocks/CropperToolbar/CropperToolbar";
import CropperGrid from "./blocks/CropperGrid";
import CropperRotate from './blocks/CropperRotate/CropperRotate.container';
import CropperTab from "./blocks/CropperToolbar/blocks/CropperTab";
import {Store} from "@muzikanto/observable";
import {
    CropperAspectRationKeys,
    CropperCustomAspectRation,
    getDefaultAspectRatio
} from "./blocks/CropperToolbarTools/blocks/CropperAspectRatio";
import Typography from "@material-ui/core/Typography";
import LinearProgress from "@material-ui/core/LinearProgress";
import CropperSubBarColors from "./blocks/CropperToolbarColors/CropperToolbarColors";
import clsx from 'clsx';

// https://html5rocks.com/en/tutorials/canvas/imagefilters/

const styles = () => ({
    root: {
        boxSizing: 'border-box',
        // overflow: 'hidden',
        position: 'relative',
        borderRadius: 10,
        background: 'radial-gradient(#4f4c4c, #000000)',
        boxShadow: '0 0.65rem 0.5rem -0.5rem rgba(0,0,0,.5), 0 0.75rem 3rem rgba(0,0,0,.5)',
    },
    loadingBox: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        color: 'white',
        borderRadius: 10,
        background: 'radial-gradient(#4f4c4c, #000000)',
        filter: 'brightness(0.6)',
    },
    hidden: {
        opacity: 0,
    },
    subBar: {
        height: 72,
    },
    canvas: {
        borderRadius: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        cursor: 'move',
    },
} as const);

export interface CropperState {
    tab: number;
}

export interface CropperProps extends WithStyles<typeof styles> {
    src: string;
    style?: React.CSSProperties;
    className?: string;

    onChange?: (base64: string) => void;

    container?: { width: number; height: number; };

    minZoom?: number;
    maxZoom?: number;
    minWidth?: number;
    minHeight?: number;

    aspectRatio?: number | Array<CropperAspectRationKeys | CropperCustomAspectRation>;
    flippedX?: boolean;
    flippedY?: boolean;
    flipped?: boolean;
    rotatedLeft?: boolean;
    rotatedRight?: boolean;
    rotate?: boolean;
    rotateToAngle?: boolean;
    sizePreview?: boolean;

    managerRef?: (manager: CropManager) => void;

    backgroundFillStyle?: string;
}

class Cropper extends React.Component<CropperProps, CropperState> {
    public gridRef: HTMLDivElement | null = null;
    public areaRef: HTMLDivElement | null = null;
    public canvasRef: HTMLCanvasElement | null = null;
    protected container: { width: number; height: number; };

    public state = {tab: 0};

    protected store: Store<CropManagerState>;

    constructor(props: CropperProps) {
        super(props);

        this.store = createStore<CropManagerState>({
            imageCrop: {x: 0, y: 0, width: 0, height: 0},
            crop: {x: 0, y: 0, width: 0, height: 0},
            zoom: 1,
            initialZoom: 1,
            initialChanged: false,
            changed: false,
            lastChanged: null,
            angle: 0,
            flipX: false,
            flipY: false,
            aspectRatio: getDefaultAspectRatio(props.aspectRatio),
            minSize: {
                width: 50 || this.props.minWidth,
                height: 50 || this.props.minHeight,
            },
            loadedImage: false,

            filterBrightness: 100,
            filterContrast: 1,
            filterSaturate: 100,
            filterGrayScale: 0,
            filterBlur: 0,
        });

        this.container = props.container || {width: 928, height: 528};
    }

    protected manager: CropManager | null = null;

    public componentDidMount(): void {
        if (this.areaRef && this.canvasRef && this.gridRef) {
            this.manager = new CropManager(this.store, this.canvasRef, this.areaRef, {backgroundFillStyle: this.props.backgroundFillStyle});

            if (this.props.managerRef) {
                this.props.managerRef(this.manager);
            }

            this.bindEvents();

            this.manager.loadImage(this.props.src);
        }
    }

    public bindEvents = () => {
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.clearDragged);
        document.addEventListener('mouseleave', this.clearDragged);

        if (this.gridRef && this.areaRef && this.canvasRef) {
            this.gridRef.addEventListener('wheel', this.onMouseWheel);
            this.canvasRef.addEventListener('mousedown', this.onMouseDown);
            this.areaRef.addEventListener('mousedown', this.onMouseDown);
        }
    }
    public unBindEvents = () => {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.clearDragged);
        document.removeEventListener('mouseleave', this.clearDragged);

        if (this.gridRef && this.areaRef && this.canvasRef) {
            this.gridRef.removeEventListener('wheel', this.onMouseWheel);
            this.canvasRef.removeEventListener('mousedown', this.onMouseDown);
            this.areaRef.removeEventListener('mousedown', this.onMouseDown);
        }
    }

    public componentDidUpdate(prevProps: Readonly<CropperProps>, prevState: Readonly<CropperState>) {
        if (this.state.tab === 0 && prevState.tab === 1) {
            this.bindEvents();
        }
        if (this.state.tab !== 0 && prevState.tab === 0) {
            this.unBindEvents();
        }
    }

    public componentWillUnmount(): void {
        this.unBindEvents();
    }

    public render() {
        const {classes} = this.props;
        const {tab} = this.state;
        const store = this.store;

        const rotateToAngle = this.props.rotateToAngle || this.props.rotate;

        return (
            <StoreConsumer store={this.store} selector={s => s.loadedImage}>
                {
                    (loaded: boolean) =>
                        <Box
                            width={this.container.width}
                            height={this.container.height}
                            className={clsx(classes.root, this.props.className)}
                            style={this.props.style}
                        >
                            <CropperToolbar
                                store={store}
                                tab={tab}
                                onChangeTab={(v) => this.setState((prevState) => ({...prevState, tab: v}))}
                                onDone={() => {
                                    const base64 = this.manager!.toBase64();

                                    if (this.props.onChange) {
                                        this.props.onChange(base64);
                                    }
                                }}
                                onRefresh={() => this.manager!.refreshState()}
                            />

                            <CropperTab tab={this.state.tab} value={0}>
                                <CropperSubBarCrop
                                    className={classes.subBar}
                                    store={store}

                                    onAspectRatio={v => this.manager!.aspectRatio(v)}
                                    onFlipX={() => this.manager!.flipX()}
                                    onFlipY={() => this.manager!.flipY()}
                                    onRotateLeft={() => this.manager!.rotateLeft()}
                                    onRotateRight={() => this.manager!.rotateRight()}

                                    aspectRatio={this.props.aspectRatio}
                                    flippedX={this.props.flippedX}
                                    flippedY={this.props.flippedY}
                                    flipped={this.props.flipped}
                                    rotatedLeft={this.props.rotatedLeft}
                                    rotatedRight={this.props.rotatedRight}
                                    rotate={this.props.rotate}
                                />

                                <CropperGrid
                                    store={store}
                                    onMouseUp={this.clearDragged}
                                    onMouseDown={(type, data) => this.manager!.setDragged(type, data)}
                                    areaRef={areaRef => this.areaRef = areaRef}
                                    gridRef={gridRef => this.gridRef = gridRef}

                                    rotateToAngle={this.props.rotateToAngle}
                                    sizePreview={this.props.sizePreview}
                                />

                                {
                                    rotateToAngle &&
                                    <StoreConsumer store={store} selector={s => s.angle}>
                                        {
                                            (angle: number) => {
                                                return (
                                                    <CropperRotate
                                                        value={angle}
                                                        onChange={v => {
                                                            this.manager!.rotate(v);
                                                        }}
                                                    />
                                                );
                                            }
                                        }
                                    </StoreConsumer>
                                }
                            </CropperTab>

                            <CropperTab tab={this.state.tab} value={1}>
                                <CropperSubBarColors
                                    store={this.store}
                                    manager={this.manager!}
                                />
                            </CropperTab>

                            <canvas
                                ref={canvasRef => this.canvasRef = canvasRef}
                                className={classes.canvas}
                                width={this.container.width}
                                height={this.container.height}
                            />

                            {
                                !loaded &&
                                <div className={classes.loadingBox}>
                                    <Typography>Loading</Typography>
                                    <LinearProgress style={{width: 300, marginTop: 7}}/>
                                </div>
                            }
                        </Box>
                }
            </StoreConsumer>
        );
    }

    protected clearDragged = () => {
        this.manager!.clearDragged();
    };

    protected onMouseMove = (e: any) => {
        this.manager!.move(
            {x: e.clientX, y: e.clientY},
        );
    };

    protected onMouseWheel = (e: any) => {
        e.preventDefault();
        e.stopPropagation();

        this.manager!.zoom(e.deltaY);
    }

    protected onMouseDown = (e: any) => {
        this.manager!.setDragged('image', {x: e.clientX, y: e.clientY});
    }
}

export default withStyles(styles)(Cropper);
